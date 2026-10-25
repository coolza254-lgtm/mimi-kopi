use std::fs::File;
use std::io::{Read, Write};

const MAX_BYTES: u64 = 5 * 1024 * 1024;

#[tauri::command]
pub async fn song_file_read(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = File::open(path).map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        file.take(MAX_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("Song file too large".into());
        }
        String::from_utf8(bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn song_file_write(path: String, contents: String) -> Result<(), String> {
    if contents.len() as u64 > MAX_BYTES {
        return Err("Song file too large".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut file = File::create(path).map_err(|e| e.to_string())?;
        file.write_all(contents.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
