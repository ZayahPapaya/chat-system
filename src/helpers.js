export function timestamp() {
  const options = {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };
  return new Date(Date.now()).toLocaleTimeString(undefined, options);
}

export function parseMessage(messageObj) {
  const { name, content, timestamp } = messageObj;
  return `${name} at ${timestamp}: ${content}`;
}