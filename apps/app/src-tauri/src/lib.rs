//! Desktop shell for Kladka. The UI is the same offline web bundle as the PWA/Android app;
//! native features: "Save as" / "Open" dialogs, reading or writing the file the user chose, and opening
//! links (schematic sites, docs) in the default browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Kladka");
}
