use std::fs;
use std::path::{Path, PathBuf};

use crate::models::{DirectoryNode, DirectoryNodeKind};

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<DirectoryNode>, String> {
    scan_folder_entries(Path::new(&path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
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
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
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

        let file_path = root.join("read-me.md");
        fs::write(&file_path, "# Hello\n\nWorld").expect("write markdown file");

        let content = crate::commands::fs::read_markdown_file(file_path.to_string_lossy().into_owned())
            .expect("read markdown file");

        assert_eq!(content, "# Hello\n\nWorld");

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }

    #[test]
    fn save_markdown_file_writes_content_to_disk() {
        let root = unique_temp_dir();
        let file_path = root.join("nested").join("save-me.md");

        crate::commands::fs::save_markdown_file(
            file_path.to_string_lossy().into_owned(),
            "# Saved\n\nContent".to_string(),
        )
            .expect("save markdown file");

        let on_disk = fs::read_to_string(&file_path).expect("read saved file");
        assert_eq!(on_disk, "# Saved\n\nContent");

        fs::remove_dir_all(&root).expect("clean up temp tree");
    }
}
