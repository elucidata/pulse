import"../chunk-H6Z3WHYR.js";import{a as p,b as l,c as x,d as u,e as v,f as P,g as T,h as d}from"../chunk-CUI6NBDB.js";import*as e from"react";function E(n){return function(c){let[,r]=e.useState(0),t=e.useRef(null);if(!t.current){let f=new u(()=>{r(i=>i+1)});t.current=f}e.useEffect(()=>()=>{t.current?.cleanup()},[]);let o=null,a=p();l(t.current);try{o=n(c)}finally{l(a)}return o}}import{useState as R,useRef as s,useEffect as C}from"react";function S(n){let[m,c]=R(()=>n()),r=s(n);r.current=n;let t=s(null);return C(()=>{let o=new u(()=>{let a=r.current();c(a)});return t.current=o,()=>{o.cleanup(),t.current=null}},[]),m}export{x as Signal,d as batch,T as computed,P as effect,E as observer,v as signal,S as useComputed};
