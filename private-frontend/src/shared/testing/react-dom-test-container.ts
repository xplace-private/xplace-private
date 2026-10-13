const htmlNamespace = 'http://www.w3.org/1999/xhtml'

interface ReactDomTestDocument {
  nodeType: 9
  documentElement: { namespaceURI: string }
  addEventListener(): void
  removeEventListener(): void
  createElement(nodeName: string): ReactDomTestElement
  createElementNS(
    namespace: string | null,
    nodeName: string,
  ): ReactDomTestElement
}

interface ReactDomTestElement {
  nodeType: 1
  nodeName: string
  tagName: string
  namespaceURI: string
  ownerDocument: ReactDomTestDocument
  style: Record<string, string>
  addEventListener(): void
  removeEventListener(): void
  appendChild(child: ReactDomTestElement): ReactDomTestElement
  insertBefore(
    child: ReactDomTestElement,
    reference: ReactDomTestElement | null,
  ): ReactDomTestElement
  removeChild(child: ReactDomTestElement): ReactDomTestElement
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export type ReactDomTestContainer = ReactDomTestElement

declare module 'react-dom/client' {
  export function createRoot(
    container: ReactDomTestContainer,
    options?: RootOptions,
  ): Root
}

function createTestElement(
  ownerDocument: ReactDomTestDocument,
  nodeName: string,
): ReactDomTestElement {
  const children: ReactDomTestElement[] = []
  const attributes = new Map<string, string>()
  const normalizedName = nodeName.toUpperCase()

  return {
    nodeType: 1,
    nodeName: normalizedName,
    tagName: normalizedName,
    namespaceURI: htmlNamespace,
    ownerDocument,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) {
      children.push(child)
      return child
    },
    insertBefore(child, reference) {
      const index = reference === null ? -1 : children.indexOf(reference)
      if (index === -1) children.push(child)
      else children.splice(index, 0, child)
      return child
    },
    removeChild(child) {
      const index = children.indexOf(child)
      if (index !== -1) children.splice(index, 1)
      return child
    },
    setAttribute(name, value) {
      attributes.set(name, value)
    },
    removeAttribute(name) {
      attributes.delete(name)
    },
  }
}

export function createReactDomTestContainer(): ReactDomTestContainer {
  const ownerDocument: ReactDomTestDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: htmlNamespace },
    addEventListener() {},
    removeEventListener() {},
    createElement(nodeName) {
      return createTestElement(ownerDocument, nodeName)
    },
    createElementNS(namespace, nodeName) {
      void namespace
      return createTestElement(ownerDocument, nodeName)
    },
  }

  return createTestElement(ownerDocument, 'div')
}
