use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::models::MarkdownFileEntry;

#[tauri::command]
pub fn get_startup_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<MarkdownFileEntry>, String> {
    let path = Path::new(&path);
    validate_directory_path(path)?;
    scan_folder_entries(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    validate_markdown_path(Path::new(&path))?;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    validate_markdown_path(&path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

pub fn scan_folder_entries(path: &Path) -> std::io::Result<Vec<MarkdownFileEntry>> {
    let mut entries = Vec::new();
    scan_folder_entries_inner(path, path, &mut entries)?;
    entries.sort_by(|left, right| {
        left.relative_path
            .cmp(&right.relative_path)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(entries)
}

fn scan_folder_entries_inner(
    root_path: &Path,
    current_path: &Path,
    entries: &mut Vec<MarkdownFileEntry>,
) -> std::io::Result<()> {
    for entry in fs::read_dir(current_path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let metadata = fs::symlink_metadata(&entry_path)?;
        let file_type = metadata.file_type();

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            scan_folder_entries_inner(root_path, &entry_path, entries)?;
            continue;
        }

        if is_markdown_file(&entry_path) {
            let relative_path = entry_path
                .strip_prefix(root_path)
                .unwrap_or(&entry_path)
                .to_string_lossy()
                .into_owned();
            let normalized_relative_path = normalize_separators(&relative_path);
            let directory_label = directory_label_from_relative_path(&normalized_relative_path);
            let excerpt = extract_excerpt(&entry_path);
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| {
                    let millis = duration.as_millis();
                    if millis > i64::MAX as u128 {
                        i64::MAX
                    } else {
                        millis as i64
                    }
                });

            entries.push(MarkdownFileEntry {
                path: entry_path.to_string_lossy().into_owned(),
                relative_path: normalized_relative_path,
                name: entry.file_name().to_string_lossy().into_owned(),
                directory_label,
                excerpt,
                modified_at,
            });
        }
    }

    Ok(())
}

fn validate_markdown_path(path: &Path) -> Result<(), String> {
    if is_markdown_file(path) {
        validate_path_has_no_symlink_components(path)
    } else {
        Err("only .md files are supported".to_string())
    }
}

fn validate_directory_path(path: &Path) -> Result<(), String> {
    validate_path_has_no_symlink_components(path)
}

fn validate_path_has_no_symlink_components(path: &Path) -> Result<(), String> {
    for candidate in path.ancestors() {
        if let Ok(metadata) = fs::symlink_metadata(candidate) {
            if metadata.file_type().is_symlink() {
                return Err("symlink paths are not supported".to_string());
            }
        }
    }
    Ok(())
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn normalize_separators(path: &str) -> String {
    path.replace('\\', "/")
}

fn directory_label_from_relative_path(relative_path: &str) -> String {
    let parent = Path::new(relative_path).parent();
    match parent {
        Some(parent) if !parent.as_os_str().is_empty() => {
            normalize_separators(parent.to_string_lossy().as_ref())
        }
        _ => ".".to_string(),
    }
}

fn extract_excerpt(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(truncate_excerpt)
}

fn truncate_excerpt(line: &str) -> String {
    const MAX_EXCERPT_CHARS: usize = 180;
    if line.chars().count() <= MAX_EXCERPT_CHARS {
        return line.to_string();
    }

    let mut truncated = line.chars().take(MAX_EXCERPT_CHARS).collect::<String>();
    truncated.push_str("...");
    truncated
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::commands::fs::scan_folder_entries;

    fn unique_temp_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time moved backwards")
            .as_nanos();
        dir.push(format!("md-editor-fs-{unique}"));
        dir
    }

    #[test]
    fn scan_folder_entries_recursively_returns_flat_markdown_entries_with_relative_metadata() {
        let root = unique_temp_dir();
        let nested = root.join("folder").join("nested");

        fs::create_dir_all(&nested).expect("create nested directory");
        fs::write(root.join("notes.md"), "# Notes").expect("write markdown file");
        fs::write(root.join("notes.txt"), "ignore").expect("write text file");
        fs::write(root.join("folder").join("draft.md"), "# Draft")
            .expect("write nested markdown file");
        fs::write(root.join("folder").join("image.png"), "ignore")
            .expect("write nested binary placeholder");
        fs::write(nested.join("deep.md"), "# Deep").expect("write deep markdown file");

        let entries = scan_folder_entries(&root).expect("scan folder");

        assert_eq!(entries.len(), 3);
        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.relative_path.as_str())
                .collect::<Vec<_>>(),
            vec!["folder/draft.md", "folder/nested/deep.md", "notes.md"]
        );

        assert_eq!(entries[0].name, "draft.md");
        assert_eq!(entries[0].directory_label, "folder");
        assert_eq!(entries[1].name, "deep.md");
        assert_eq!(entries[1].directory_label, "folder/nested");
        assert_eq!(entries[2].name, "notes.md");
        assert_eq!(entries[2].directory_label, ".");

        assert_eq!(entries[0].excerpt.as_deref(), Some("# Draft"));
        assert_eq!(entries[1].excerpt.as_deref(), Some("# Deep"));
        assert_eq!(entries[2].excerpt.as_deref(), Some("# Notes"));

        assert!(entries.iter().all(|entry| entry.modified_at.is_some()));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn scan_folder_entries_extracts_excerpt_from_first_non_empty_line() {
        let root = unique_temp_dir();
        let file_path = root.join("notes.md");

        fs::create_dir_all(&root).expect("create temp directory");
        fs::write(&file_path, "\n\n   \nFirst useful line\nSecond line").expect("write markdown file");

        let entries = scan_folder_entries(&root).expect("scan folder");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].excerpt.as_deref(), Some("First useful line"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn read_markdown_file_returns_file_contents() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).expect("create temp directory");

        let file_path = root.join("read-me.MD");
        fs::write(&file_path, "# Hello\n\nWorld").expect("write markdown file");

        let content = crate::commands::fs::read_markdown_file(file_path.to_string_lossy().into_owned())
            .expect("read markdown file");

        assert_eq!(content, "# Hello\n\nWorld");

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn read_markdown_file_replaces_invalid_utf8_in_renamed_binary_files() {
        let root = unique_temp_dir();
        let file_path = root.join("renamed-workbook.md");

        fs::create_dir_all(&root).expect("create temp directory");
        fs::write(&file_path, b"PK\x03\x04\xFFworkbook").expect("write binary markdown file");

        let content =
            crate::commands::fs::read_markdown_file(file_path.to_string_lossy().into_owned())
                .expect("renamed binary file should remain editable");

        assert_eq!(content, "PK\u{3}\u{4}\u{FFFD}workbook");

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn save_markdown_file_writes_content_to_disk() {
        let root = unique_temp_dir();
        let file_path = root.join("nested").join("save-me.MD");

        crate::commands::fs::save_markdown_file(
            file_path.to_string_lossy().into_owned(),
            "# Saved\n\nContent".to_string(),
        )
        .expect("save markdown file");

        let on_disk = fs::read_to_string(&file_path).expect("read saved file");
        assert_eq!(on_disk, "# Saved\n\nContent");

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn read_markdown_file_rejects_non_markdown_paths() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).expect("create temp directory");

        let file_path = root.join("notes.txt");
        fs::write(&file_path, "plain text").expect("write text file");

        let error = crate::commands::fs::read_markdown_file(file_path.to_string_lossy().into_owned())
            .expect_err("non-markdown path should be rejected");

        assert!(error.contains(".md"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn save_markdown_file_rejects_non_markdown_paths() {
        let root = unique_temp_dir();
        let file_path = root.join("draft.TXT");

        let error = crate::commands::fs::save_markdown_file(
            file_path.to_string_lossy().into_owned(),
            "# Nope".to_string(),
        )
        .expect_err("non-markdown path should be rejected");

        assert!(error.contains(".md"));

        assert!(!file_path.exists());
        fs::remove_dir_all(&root).ok();
    }

    #[cfg(windows)]
    #[test]
    fn read_markdown_file_rejects_symlinked_parent_directories() {
        use std::os::windows::fs::symlink_dir;

        let root = unique_temp_dir();
        let real_dir = root.join("real");
        let link_dir = root.join("linked");
        let file_path = link_dir.join("note.md");

        fs::create_dir_all(&real_dir).expect("create real directory");
        fs::write(real_dir.join("note.md"), "# Note").expect("write markdown target");

        if let Err(err) = symlink_dir(&real_dir, &link_dir) {
            eprintln!(
                "skipping parent symlink regression test because symlink creation failed: {err}"
            );
            fs::remove_dir_all(&root).ok();
            return;
        }

        let error = crate::commands::fs::read_markdown_file(file_path.to_string_lossy().into_owned())
            .expect_err("path through symlinked parent should be rejected");

        assert!(error.contains("symlink"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[cfg(windows)]
    #[test]
    fn save_markdown_file_rejects_symlinked_parent_directories() {
        use std::os::windows::fs::symlink_dir;

        let root = unique_temp_dir();
        let real_dir = root.join("real");
        let link_dir = root.join("linked");
        let file_path = link_dir.join("note.md");

        fs::create_dir_all(&real_dir).expect("create real directory");

        if let Err(err) = symlink_dir(&real_dir, &link_dir) {
            eprintln!(
                "skipping parent symlink regression test because symlink creation failed: {err}"
            );
            fs::remove_dir_all(&root).ok();
            return;
        }

        let error = crate::commands::fs::save_markdown_file(
            file_path.to_string_lossy().into_owned(),
            "# Note".to_string(),
        )
        .expect_err("path through symlinked parent should be rejected");

        assert!(error.contains("symlink"));
        assert!(!real_dir.join("note.md").exists());

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[cfg(windows)]
    #[test]
    fn read_markdown_file_rejects_markdown_symlink_paths() {
        use std::os::windows::fs::symlink_file;

        let root = unique_temp_dir();
        let target_path = root.join("target.md");
        let link_path = root.join("linked.md");

        fs::create_dir_all(&root).expect("create temp directory");
        fs::write(&target_path, "# Target").expect("write markdown target");

        if let Err(err) = symlink_file(&target_path, &link_path) {
            eprintln!("skipping symlink regression test because symlink creation failed: {err}");
            fs::remove_dir_all(&root).ok();
            return;
        }

        let error = crate::commands::fs::read_markdown_file(link_path.to_string_lossy().into_owned())
            .expect_err("markdown symlink path should be rejected");

        assert!(error.contains("symlink") || error.contains(".md"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[cfg(windows)]
    #[test]
    fn save_markdown_file_rejects_markdown_symlink_paths() {
        use std::os::windows::fs::symlink_file;

        let root = unique_temp_dir();
        let target_path = root.join("target.md");
        let link_path = root.join("linked.md");

        fs::create_dir_all(&root).expect("create temp directory");
        fs::write(&target_path, "# Target").expect("write markdown target");

        if let Err(err) = symlink_file(&target_path, &link_path) {
            eprintln!("skipping symlink regression test because symlink creation failed: {err}");
            fs::remove_dir_all(&root).ok();
            return;
        }

        let error = crate::commands::fs::save_markdown_file(
            link_path.to_string_lossy().into_owned(),
            "# New Content".to_string(),
        )
        .expect_err("markdown symlink path should be rejected");

        assert!(error.contains("symlink") || error.contains(".md"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[cfg(windows)]
    #[test]
    fn scan_folder_rejects_symlinked_root_directory() {
        use std::os::windows::fs::symlink_dir;

        let root = unique_temp_dir();
        let real_dir = root.join("real");
        let link_dir = root.join("linked");

        fs::create_dir_all(&real_dir).expect("create real directory");
        fs::write(real_dir.join("note.md"), "# Note").expect("write markdown target");

        if let Err(err) = symlink_dir(&real_dir, &link_dir) {
            eprintln!("skipping root symlink regression test because symlink creation failed: {err}");
            fs::remove_dir_all(&root).ok();
            return;
        }

        let error = crate::commands::fs::scan_folder(link_dir.to_string_lossy().into_owned())
            .expect_err("symlinked root directory should be rejected");

        assert!(error.contains("symlink"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[cfg(windows)]
    #[test]
    fn scan_folder_entries_skips_symlinked_directories() {
        use std::os::windows::fs::symlink_dir;

        let root = unique_temp_dir();
        let real_dir = root.join("real");
        let target_dir = root.join("target");
        let link_dir = root.join("link");

        fs::create_dir_all(&real_dir).expect("create real directory");
        fs::create_dir_all(&target_dir).expect("create target directory");
        fs::write(target_dir.join("inside.md"), "# Target").expect("write target markdown");
        fs::write(real_dir.join("local.md"), "# Local").expect("write local markdown");

        if let Err(err) = symlink_dir(&target_dir, &link_dir) {
            eprintln!("skipping symlink test because symlink creation failed: {err}");
            fs::remove_dir_all(&root).ok();
            return;
        }

        let entries = scan_folder_entries(&root).expect("scan folder");

        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .all(|entry| !entry.path.contains("\\link\\") && !entry.path.contains("/link/")));
        assert!(entries.iter().any(|entry| entry.name == "local.md"));
        assert!(entries.iter().any(|entry| entry.name == "inside.md"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }
}
