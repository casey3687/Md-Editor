use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarkdownFileEntry {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub directory_label: String,
    pub excerpt: Option<String>,
    pub modified_at: Option<i64>,
}
