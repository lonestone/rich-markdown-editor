import { keymap } from "prosemirror-keymap";
import {
  prosemirrorToYDoc,
  redo,
  undo,
  yCursorPlugin,
  ySyncPlugin,
  yUndoPlugin,
} from "y-prosemirror";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import Extension from "../lib/Extension";

interface YCollabContext {
  docId: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  yXmlFragment: Y.XmlFragment;
}

// Map contexts by id to keep provider and ydoc for each document
const contexts: Map<string, YCollabContext> = new Map();

export default class YCollab extends Extension {
  public ydoc: Y.Doc;
  public provider: WebrtcProvider;
  public yXmlFragment: Y.XmlFragment;

  constructor(public docId: string) {
    super();

    const { ydoc, yXmlFragment, provider } = this.getContext();
    this.ydoc = ydoc;
    this.yXmlFragment = yXmlFragment;
    this.provider = provider;
  }

  get name(): string {
    return "y-collab";
  }

  get plugins() {
    return [
      ySyncPlugin(this.yXmlFragment),
      yCursorPlugin(this.provider.awareness),
      yUndoPlugin(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
      }),
    ];
  }

  getContext(): YCollabContext {
    const existingProvider = contexts.get(this.docId);
    if (existingProvider) return existingProvider;

    // Create new Y doc
    const ydoc = new Y.Doc();

    // Connect WebRTC provider with doc
    const provider = new WebrtcProvider(this.docId, ydoc);
    const yXmlFragment = ydoc.getXmlFragment("prosemirror");

    const context = {
      docId: this.docId,
      ydoc,
      provider,
      yXmlFragment,
    };

    contexts.set(this.docId, context);
    return context;
  }

  stop() {
    const context = contexts.get(this.docId);
    if (!context) return;
    context.provider.destroy();
    contexts.delete(this.docId);
  }

  setUserName(name: string, color: string) {
    // Set username
    this.provider.awareness.setLocalStateField("user", {
      color,
      name,
    });
  }

  applyUpdates(updates: Uint8Array) {
    Y.applyUpdate(this.ydoc, updates);
  }

  applyValue(value: string) {
    const tmpYdoc = prosemirrorToYDoc(this.editor.createState(value).doc);
    const state = Y.encodeStateAsUpdate(tmpYdoc);
    Y.applyUpdate(this.ydoc, state);
  }

  getUpdates(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }
}
