import { getString } from "../utils/locale";
import { ChatUIFactory } from "./chat/ui";

export class ChatSectionFactory {
  // Single global ChatUIFactory instance (stateless UI, renders on each item change)
  private static chatUI: ChatUIFactory | null = null;

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
    // Initialize single ChatUIFactory instance
    if (!this.chatUI) {
      this.chatUI = new ChatUIFactory();
    }

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

      onItemChange(params) {
        if (params.tabType !== "reader") {
          return;
        }
        const { body, item } = params;
        const doc = body.ownerDocument as Document;
        const itemID = item.id;
        console.log("onItemChange", itemID);
        // Clear existing content in body
        body.innerHTML = "";

        // Re-render chat panel with new doc
        const chatPanel = ChatSectionFactory.chatUI?.createChatPanel(
          doc,
        ) as HTMLElement;
        body.appendChild(chatPanel);
        ChatSectionFactory.chatUI?.setCurrentDoc(
          chatPanel.ownerDocument as Document,
        );
        // Request history for current session
        ChatSectionFactory.chatUI?.requestHistory(
          ChatSectionFactory.chatUI?.getState().currentSession?.session_id ||
            "",
        );
      },

      onRender: (params) => {},

      sectionButtons: [
        {
          type: "refresh",
          icon: "chrome://zotero/skin/16/universal/refresh.svg",
          l10nID: "zoteroclaw-chat-section-refresh-tooltip",
          onClick: (params) => {
            const { body } = params;
            const doc = body.ownerDocument as Document;
            ChatSectionFactory.chatUI?.setCurrentDoc(doc);
            // Refresh history for current session
            ChatSectionFactory.chatUI?.requestHistory(
              ChatSectionFactory.chatUI?.getState().currentSession
                ?.session_id || "",
            );
          },
        },
      ],
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
   * Get the global ChatUIFactory instance
   */
  static getChatUI(): ChatUIFactory | null {
    return this.chatUI;
  }
}
