use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Autostart-on-login is desktop-only.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // --- System tray: keep Mochi alive in the background ---
            let show_i =
                MenuItem::with_id(app, "show_dashboard", "Show Dashboard", true, None::<&str>)?;
            let sleep_i = MenuItem::with_id(app, "sleep_pet", "Sleep Pet", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Mochi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sleep_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("mochi-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Mochi AI")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_dashboard" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "sleep_pet" => {
                        let _ = app.emit("tray://sleep_pet", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // Closing the dashboard hides it instead of quitting; the pet keeps living.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
