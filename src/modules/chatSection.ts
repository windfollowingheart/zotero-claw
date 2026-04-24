import { getString } from "../utils/locale";
import { chatAPI } from "./chat/api";
import { ChatUIFactory } from "./chat/ui";

export class ChatSectionFactory {
  private static chatUI: ChatUIFactory | null = new ChatUIFactory();

  static registerStyleSheet(win: _ZoteroTypes.MainWindow) {
    const doc = win.document;

    doc.documentElement?.appendChild(
      ztoolkit.UI.createElement(doc, "link", {
        properties: {
          type: "text/css",
          rel: "stylesheet",
          href: `chrome://${addon.data.config.addonRef}/content/zoteroPane.css`,
        },
      }),
    );
    doc.documentElement?.appendChild(
      ztoolkit.UI.createElement(doc, "link", {
        properties: {
          type: "text/css",
          rel: "stylesheet",
          href: `chrome://${addon.data.config.addonRef}/content/chat.css`,
        },
      }),
    );
  }

  static async registerChatSection() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "zoteroclaw-chat-section",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: "zoteroclaw-chat-section-header",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      sidenav: {
        l10nID: "zoteroclaw-chat-section-sidenav-tooltip",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
      },
      // Optional
      // bodyXHTML:
      // '<html:h1 id="test">THIS IS TEST11</html:h1><browser disableglobalhistory="true" remote="true" maychangeremoteness="true" type="content" flex="1" id="browser" style="width: 180%; height: 280px"/>',

      // Called when the section is asked to render, must be synchronous.
      onRender: ({ body, item }) => {
        // ztoolkit.log("Section rendered!", item?.id);
        // const title = body.querySelector("#test") as HTMLElement;
        // title.style.color = "red";
        // title.textContent = "LOADING";
        // setL10nArgs(`{ "status": "Loading" }`);
        // setSectionSummary("loading!");
        // setSectionButtonStatus("test", { hidden: true });
        const chatPanel = this.chatUI?.createChatPanel(
          body.ownerDocument as Document,
        ) as HTMLElement;
        console.log(this.chatUI);
        console.log(chatPanel);
        console.log(body);
        body.appendChild(chatPanel);
      },
    });
  }

  static registerPrefs() {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: getString("prefs-title"),
      image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    });
  }

  /**
   * Get chat UI factory instance
   */
  static getChatUI(): ChatUIFactory | null {
    return this.chatUI;
  }
}
