export const isDebug: boolean =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
