//! Desktop shell for Kladka. The UI is the same offline web bundle as the PWA/Android app;
//! the only native features are the "Save as" dialog and writing the chosen file.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Kladka");
}
