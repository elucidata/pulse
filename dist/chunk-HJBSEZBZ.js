import {
  effect,
  isReadonlySignal
} from "./chunk-MWIVK5UY.js";

// src/view/html.ts
import htm from "htm";

// src/view/runtime.ts
var contextStack = [];
function setContext(key, value) {
  if (contextStack.length === 0) {
    throw new Error("setContext must be called within a component");
  }
  contextStack[contextStack.length - 1]?.set(key, value);
}
function getContext(key) {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    if (contextStack[i]?.has(key)) {
      return contextStack[i]?.get(key);
    }
  }
  throw new Error("Context not found for key");
}
var cleanupStack = [];
function onMount(fn) {
  if (cleanupStack.length === 0) {
    throw new Error("onMount must be called within a component");
  }
  queueMicrotask(() => {
    const unmount = fn();
    if (unmount) {
      onUnmount(unmount);
    }
  });
}
function onUnmount(fn) {
  if (cleanupStack.length === 0) {
    throw new Error("onUnmount must be called within a component");
  }
  cleanupStack[cleanupStack.length - 1]?.push(fn);
}
function h(tag, props, ...children) {
  if (typeof tag === "function") {
    const { node } = createComponent(tag, props, children);
    return node;
  }
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") {
        continue;
      } else if (key.startsWith("on")) {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, value);
      } else if (key === "style" && typeof value === "object") {
        Object.assign(el.style, value);
      } else if (key === "use" && typeof value === "function") {
        value(el);
      } else if (typeof value === "function") {
        reactiveAttributeEffect(el, key, () => value());
      } else if (isReadonlySignal(value)) {
        reactiveAttributeEffect(el, key, () => value.value);
      } else {
        el.setAttribute(key, value);
      }
    }
  }
  const allChildren = props?.children ? Array.isArray(props.children) ? props.children : [props.children] : [];
  allChildren.push(...children);
  for (const child of allChildren) {
    appendChild(el, child);
  }
  return el;
}
function reactiveAttributeEffect(el, key, worker) {
  effect(() => {
    const newValue = worker();
    if (newValue === false || newValue == null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(newValue));
    }
  });
}
function appendChild(parent, child) {
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c));
  } else if (typeof child === "function") {
    reactiveChildContent(parent, child, () => child());
  } else if (isReadonlySignal(child)) {
    reactiveChildContent(parent, child, () => child.value);
  } else if (child && typeof child === "object" && "node" in child && "dispose" in child) {
    parent.appendChild(child.node);
    if (cleanupStack.length > 0) {
      cleanupStack[cleanupStack.length - 1]?.push(child.dispose);
    }
  } else if (child instanceof Node) {
    parent.appendChild(child);
  } else if (child !== null && child !== void 0) {
    parent.appendChild(document.createTextNode(String(child)));
  }
}
function reactiveChildContent(parent, child, worker) {
  let start = document.createComment("start");
  let end = document.createComment("end");
  parent.appendChild(start);
  parent.appendChild(end);
  effect(() => {
    const value = worker();
    const range = document.createRange();
    range.setStartAfter(start);
    range.setEndBefore(end);
    range.deleteContents();
    let nodes;
    if (value instanceof Node) {
      nodes = [value];
    } else if (Array.isArray(value)) {
      nodes = [];
      value.forEach((v) => {
        const fragment = document.createDocumentFragment();
        appendChild(fragment, v);
        nodes.push(...Array.from(fragment.childNodes));
      });
    } else if (value !== null && value !== void 0) {
      nodes = [document.createTextNode(String(value))];
    } else {
      nodes = [];
    }
    nodes.forEach((node) => {
      end.parentNode.insertBefore(node, end);
    });
  });
}
function createComponent(component, props, children) {
  const contextMap = /* @__PURE__ */ new Map();
  contextStack.push(contextMap);
  const cleanupFns = [];
  const parentCleanupFns = cleanupStack[cleanupStack.length - 1];
  cleanupStack.push(cleanupFns);
  const result = component(props, children);
  let el;
  if (Array.isArray(result)) {
    const fragment = document.createDocumentFragment();
    result.forEach((node) => {
      appendChild(fragment, node);
    });
    el = fragment;
  } else if (result instanceof Node) {
    el = result;
  } else if (result !== null && result !== void 0) {
    el = document.createTextNode(String(result));
  } else {
    el = document.createComment("");
  }
  const placeholder = document.createComment("");
  const wrapper = document.createDocumentFragment();
  wrapper.appendChild(placeholder);
  wrapper.appendChild(el);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((removedNode) => {
        if (removedNode === placeholder) {
          dispose();
        }
      });
    }
  });
  queueMicrotask(() => {
    if (placeholder.parentNode) {
      observer.observe(placeholder.parentNode, { childList: true });
    }
  });
  const dispose = () => {
    observer.disconnect();
    for (const fn of cleanupFns) {
      fn();
    }
    contextStack.pop();
    cleanupStack.pop();
  };
  if (parentCleanupFns) {
    parentCleanupFns.push(dispose);
  }
  return { node: wrapper, dispose };
}
function render(component, container) {
  const { node: fragment, dispose } = createComponent(component, null, []);
  const nodes = Array.from(fragment.childNodes);
  container.appendChild(fragment);
  let isDisposed = false;
  return () => {
    if (isDisposed) {
      return console.warn("Component already unmounted");
    }
    nodes.forEach((node) => {
      if (container.contains(node)) {
        container.removeChild(node);
      }
      dispose();
      isDisposed = true;
    });
  };
}

// src/view/html.ts
var html = htm.bind(h);

export {
  setContext,
  getContext,
  onMount,
  onUnmount,
  h,
  render,
  html
};
