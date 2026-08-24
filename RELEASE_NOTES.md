# Document Lab Release

Document Lab is a local-first desktop reader that turns EPUB and TXT books into paper-style documents with dense academic layouts, generated figures, and optional real text statistics.

## Highlights

- Import EPUB/TXT files locally.
- Render books as single-column reports or double-column conference-style papers.
- Generate varied academic charts, tables, flow diagrams, graphs, matrices, and statistical figures.
- Configure chart frequency, typography, real-statistics timeout, and per-document redaction terms.
- Export the rendered document as PDF.
- Use a neutral book icon and compact reader toolbar for a quieter working-screen appearance.

## Installers

This release includes platform-specific builds when generated through GitHub Actions:

- macOS: `.dmg`
- Windows: `.exe` NSIS installer

## Notes

- All book parsing and rendering happens locally.
- The Windows installer is produced on the Windows GitHub Actions runner. Building Windows packages from macOS is not the recommended release path.
- The macOS build is unsigned by default unless Apple signing secrets are added to the repository.
