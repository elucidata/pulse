import {
  effect
} from "./chunk-KVACTCNH.js";

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
  queueMicrotask(fn);
}
function onUnmount(fn) {
  if (cleanupStack.length === 0) {
    throw new Error("onUnmount must be called within a component");
  }
  cleanupStack[cleanupStack.length - 1]?.push(fn);
}
function h(tag, props, ...children) {
  if (typeof tag === "function") {
    return createComponent(tag, props, children);
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
function appendChild(parent, child) {
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c));
  } else if (typeof child === "function") {
    let node = document.createComment("");
    parent.appendChild(node);
    effect(() => {
      const value = child();
      let newNode;
      if (value instanceof Node) {
        newNode = value;
      } else if (Array.isArray(value)) {
        const fragment = document.createDocumentFragment();
        value.forEach((v) => {
          appendChild(fragment, v);
        });
        newNode = fragment;
      } else {
        newNode = document.createTextNode(String(value));
      }
      if (node.parentNode) {
        node.parentNode.replaceChild(newNode, node);
      }
      node = newNode;
    });
  } else if (child instanceof Node) {
    parent.appendChild(child);
  } else if (child !== null && child !== void 0) {
    parent.appendChild(document.createTextNode(String(child)));
  }
}
function createComponent(component, props, children) {
  const contextMap = /* @__PURE__ */ new Map();
  contextStack.push(contextMap);
  const cleanupFns = [];
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
    console.log("Mutation observed!!!, mutations: ", mutations);
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((removedNode) => {
        if (removedNode === placeholder) {
          observer.disconnect();
          for (const fn of cleanupFns) {
            fn();
          }
          contextStack.pop();
          cleanupStack.pop();
        }
      });
    }
  });
  queueMicrotask(() => {
    if (placeholder.parentNode) {
      console.log("Observing placeholder!");
      observer.observe(placeholder.parentNode, { childList: true });
    }
  });
  return wrapper;
}
function render(component, container) {
  const fragment = createComponent(component, null, []);
  const nodes = Array.from(fragment.childNodes);
  container.appendChild(fragment);
  return () => {
    nodes.forEach((node) => {
      if (container.contains(node)) {
        container.removeChild(node);
      }
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
