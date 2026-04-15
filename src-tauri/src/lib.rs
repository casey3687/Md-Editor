pub mod commands;
pub mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs::get_startup_args,
            commands::fs::scan_folder,
            commands::fs::read_markdown_file,
            commands::fs::save_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn tauri_shell_smoke_test() {
        assert_eq!(2 + 2, 4);
    }
}
