# Requirements

## Functional Requirements
- FR1: The app shall allow users to start a job application and fill common fields (name, email, phone, address, experience, education, skills).
- FR2: The app shall provide a sign-language input area using the device camera.
- FR3: The app shall display a live preview of the recognized text for the active form field.
- FR4: The user shall be able to edit, clear, or re-record any field.
- FR5: The app shall provide a review step before submission.
- FR6: The app shall allow the user to export or copy their completed form (prototype action).

## Accessibility Requirements
- AR1: The UI shall be fully operable without audio.
- AR2: The UI shall use clear visual cues, large touch targets, and high contrast.
- AR3: The UI shall support keyboard navigation and visible focus states.

## Non-Functional Requirements
- NFR1: The prototype shall run fully in the browser without a backend.
- NFR2: The app shall be responsive on mobile and desktop.
- NFR3: The app shall avoid heavy dependencies to keep load time low.

## Assumptions
- Sign recognition in this prototype is mocked via preset phrases and manual controls.
- Real recognition will be integrated later via a model or third-party API.
