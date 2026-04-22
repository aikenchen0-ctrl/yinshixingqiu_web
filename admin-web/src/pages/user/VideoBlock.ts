import { mergeAttributes, Node } from '@tiptap/core'

export interface VideoBlockAttributes {
  src: string
  poster?: string | null
  title?: string | null
  name?: string | null
  mimeType?: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoBlock: {
      setVideoBlock: (attributes: VideoBlockAttributes) => ReturnType
    }
  }
}

export const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      src: {
        default: '',
      },
      poster: {
        default: null,
      },
      title: {
        default: null,
      },
      name: {
        default: null,
      },
      mimeType: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video[data-video-block]',
      },
      {
        tag: 'video[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { mimeType, name, ...restAttributes } = HTMLAttributes
    const mergedAttributes = mergeAttributes(this.options.HTMLAttributes, restAttributes, {
      'data-video-block': 'true',
      controls: 'controls',
      playsinline: 'playsinline',
      preload: 'metadata',
    })

    if (name) {
      mergedAttributes['data-name'] = name
    }

    if (mimeType) {
      mergedAttributes['data-mime-type'] = mimeType
    }

    if (!mergedAttributes.title && name) {
      mergedAttributes.title = name
    }

    return ['video', mergedAttributes]
  },

  addCommands() {
    return {
      setVideoBlock:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    }
  },
})
