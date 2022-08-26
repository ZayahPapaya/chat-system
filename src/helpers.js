import { hubData } from './hub/hub.js';

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

export function cullClients() {
  clients = hubData.clients;
  clients.forEach(client => {
    if(client.disconnected){
      clients.splice(clients.indexOf(client), 1);
    }
  });
}