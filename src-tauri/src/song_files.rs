use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

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
        // Keep the existing backup intact until the new file is fully written.
        // A temporary file in the same directory makes the rename atomic.
        let destination = Path::new(&path);
        let parent = destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        file.write_all(contents.as_bytes())
            .map_err(|e| e.to_string())?;
        file.as_file().sync_all().map_err(|e| e.to_string())?;
        file.persist(destination).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::async_runtime::block_on;

    #[test]
    fn round_trips_unicode_and_replaces_an_existing_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("song.json");
        let path = path.to_string_lossy().into_owned();
        block_on(song_file_write(path.clone(), "old backup".into())).unwrap();
        let contents = "เพลงของฉัน · 練習";
        block_on(song_file_write(path.clone(), contents.into())).unwrap();
        assert_eq!(block_on(song_file_read(path)).unwrap(), contents);
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn oversized_writes_preserve_the_previous_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("song.json");
        std::fs::write(&path, "original").unwrap();
        let result = block_on(song_file_write(
            path.to_string_lossy().into_owned(),
            "x".repeat(MAX_BYTES as usize + 1),
        ));
        assert!(result.is_err());
        assert_eq!(std::fs::read_to_string(path).unwrap(), "original");
    }

    #[test]
    fn rejects_oversized_invalid_utf8_and_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("song.json");
        let name = path.to_string_lossy().into_owned();
        assert!(block_on(song_file_read(name.clone())).is_err());
        std::fs::write(&path, [0xff]).unwrap();
        assert!(block_on(song_file_read(name.clone())).is_err());
        std::fs::write(&path, vec![b' '; MAX_BYTES as usize + 1]).unwrap();
        assert!(block_on(song_file_read(name)).is_err());
    }
}
