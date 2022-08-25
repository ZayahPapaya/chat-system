export function timestamp() {
  const options = {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };
  return new Date(Date.now()).toLocaleTimeString(undefined, options);
}
