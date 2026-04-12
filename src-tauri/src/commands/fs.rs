use std::fs;
use std::path::{Path, PathBuf};

use crate::models::{DirectoryNode, DirectoryNodeKind};

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<DirectoryNode>, String> {
    validate_directory_path(Path::new(&path))?;
    scan_folder_entries(Path::new(&path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    validate_markdown_path(Path::new(&path))?;
    fs::read_to_string(path).map_err(|error| error.to_string())
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

pub fn scan_folder_entries(path: &Path) -> std::io::Result<Vec<DirectoryNode>> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let metadata = fs::symlink_metadata(&entry_path)?;
        let file_type = metadata.file_type();

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            let children = scan_folder_entries(&entry_path)?;
            entries.push(DirectoryNode {
                path: entry_path.to_string_lossy().into_owned(),
                name: entry.file_name().to_string_lossy().into_owned(),
                kind: DirectoryNodeKind::Directory,
                children: Some(children),
            });
            continue;
        }

        if is_markdown_file(&entry_path) {
            entries.push(DirectoryNode {
                path: entry_path.to_string_lossy().into_owned(),
                name: entry.file_name().to_string_lossy().into_owned(),
                kind: DirectoryNodeKind::File,
                children: None,
            });
        }
    }

    entries.sort_by(|left, right| left.name.cmp(&right.name).then_with(|| kind_rank(&left.kind).cmp(&kind_rank(&right.kind))));
    Ok(entries)
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

fn kind_rank(kind: &DirectoryNodeKind) -> u8 {
    match kind {
        DirectoryNodeKind::Directory => 0,
        DirectoryNodeKind::File => 1,
    }
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
    fn scan_folder_entries_recursively_returns_directories_and_markdown_files_only() {
        let root = unique_temp_dir();
        let nested = root.join("folder").join("nested");

        fs::create_dir_all(&nested).expect("create nested directory");
        fs::write(root.join("notes.md"), "# Notes").expect("write markdown file");
        fs::write(root.join("notes.txt"), "ignore").expect("write text file");
        fs::write(root.join("folder").join("draft.md"), "# Draft").expect("write nested markdown file");
        fs::write(root.join("folder").join("image.png"), "ignore").expect("write nested binary placeholder");
        fs::write(nested.join("deep.md"), "# Deep").expect("write deep markdown file");

        let entries = scan_folder_entries(&root).expect("scan folder");

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "folder");
        assert!(matches!(entries[0].kind, crate::models::DirectoryNodeKind::Directory));
        let folder_children = entries[0].children.as_ref().expect("folder children");
        assert_eq!(folder_children.len(), 2);
        assert_eq!(folder_children[0].name, "draft.md");
        assert!(matches!(folder_children[0].kind, crate::models::DirectoryNodeKind::File));
        assert_eq!(folder_children[1].name, "nested");
        assert!(matches!(folder_children[1].kind, crate::models::DirectoryNodeKind::Directory));
        let nested_children = folder_children[1].children.as_ref().expect("nested children");
        assert_eq!(nested_children.len(), 1);
        assert_eq!(nested_children[0].name, "deep.md");
        assert_eq!(entries[1].name, "notes.md");
        assert!(matches!(entries[1].kind, crate::models::DirectoryNodeKind::File));

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
            eprintln!("skipping parent symlink regression test because symlink creation failed: {err}");
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
            eprintln!("skipping parent symlink regression test because symlink creation failed: {err}");
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
        let link_entry = entries.iter().find(|entry| entry.name == "link");

        assert!(link_entry.is_none(), "symlinked directory should be skipped");
        assert!(entries.iter().any(|entry| entry.name == "real"));
        assert!(entries.iter().any(|entry| entry.name == "target"));

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }
}
