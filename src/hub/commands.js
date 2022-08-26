import { chatToId, chatToOthers, emitToId } from "./emit.js";

class Command {
  // this is fine to do as long as the base Command type isn't added to the AllCommands list
  name = "error";
  desc = "Something went wrong.";
  argDesc = [];

  commandEffect(messageData, ...args) {
    return; //subtypes implement this
  }
}

// possible improvement - allow arg[0] to be a specific command search
class HelpCommand extends Command {
  name = "help";
  desc = "Lists all the available commands.";

  commandEffect(messageData, ...args) {
    const built = [];
    built.push("-- All Commands --");
    for (const command of allCommands) {
      built.push(`${command.name} - ${command.desc}`);
      for (const arg in command.argDesc) {
        built.push(` * ${arg} - ${command.argDesc[arg]}`);
      }
    }
    chatToId(messageData.id, built.join("\n"));
  }
}

class NickCommand extends Command {
  name = "nick";
  desc = "Renames yourself, in case you didn't want to be some random animal.";
  argDesc = {
    newName: "Your new name.",
  };

  commandEffect(messageData, ...args) {
    const newName = args[0];
    if (!newName) {
      chatToId(messageData.id, "Provide a new name with the command.");
      return;
    }
    if (newName.length > 20) {
      chatToId(messageData.id, "Max name length is 20.");
      return;
    }
    const oldName = messageData.username;
    emitToId(messageData.id, "updateName", newName);
    chatToId(messageData.id, `Set name as ${newName}.`);
    chatToOthers(messageData.id, `${oldName} is now known as ${newName}`);
  }
}

export const allCommands = [new HelpCommand(), new NickCommand()];
