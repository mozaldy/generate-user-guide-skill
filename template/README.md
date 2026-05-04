# Default template fallback

This directory is the bundled fallback template for the `generate-user-guide` skill.

Use this template when the user does not provide a different template source.

Accepted external template sources:
- a template folder
- a ZIP/archive that can be unpacked into a template folder
- a direct file/folder path the user points to explicitly

Workflow rule:
- copy the selected template into the working docs folder
- do not edit this fallback template in place during a guide generation run
- keep the fallback template stable so future runs stay consistent
