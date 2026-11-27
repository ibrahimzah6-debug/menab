// The address a stored file is shown at in the app. It stays the same for a file, so the browser
// downloads each picture or video once and reuses it, instead of downloading it again on every
// page refresh (a new private link each time cannot be reused). See /media/[...path].
export const mediaUrl = (path: string) => `/media/${path.split("/").map(encodeURIComponent).join("/")}`;
