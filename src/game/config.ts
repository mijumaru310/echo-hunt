export const isDebug: boolean =
    new URLSearchParams(window.location.search).get("debug") === "1";