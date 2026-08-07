/**
 * Marks the article form's submit button as "save, then publish".
 *
 * The publish control lives in the sidebar card and the fields live in the
 * form — two sibling client components with no shared state. They coordinate
 * through the submit event instead: the button is associated with the form by
 * id and carries this value, and the form reads it back off
 * `SubmitEvent.submitter` to decide whether a successful save should be
 * followed by a publish.
 */
export const PUBLISH_INTENT = "publish";
