# NPS dental screening

A standalone dental screening form with radiograph charting, editable reports, and a clinical Note.

## Use locally

Keep `index.html`, `style.css`, and `script.js` together. Open `index.html` in a browser. After changing a file, reload the page.

## Put on GitHub

Upload the contents of this folder to your repository. Keep the three files together in the repository root. Extract the ZIP before uploading its contents.

To serve the app with GitHub Pages, select the branch containing these files and its root folder in the repository's Pages settings.

## Files

- `index.html`: form fields and page structure, including shared preceptor options.
- `style.css`: appearance, responsive layouts, and button/highlight effects.
- `script.js`: form behavior, radiograph charting, reports, Note copying, and browser autosave.

No build step, package installation, or external libraries are required.

## Included workflows

- New patient screening, Emergency/New patient, and Emergency/Established patient.
- Established-patient history review, conditional acceptance, consults, and referrals.
- Antibiotic prescriptions, extraction tooth selection and procedure details, and therapeutic pulpotomy.
- Editable Notes with conditional sections, local anesthesia, extraction and postoperative paragraphs.
- Glass styling, responsive fields, keyboard controls, and local browser autosave.

Form data is stored in the current browser. Moving between a local file and GitHub Pages does not transfer saved browser data. Keep the existing field IDs and storage keys when updating the form so existing saved data can still load.
