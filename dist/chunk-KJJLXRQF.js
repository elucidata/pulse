var I=()=>{},a=Symbol("pulse(disposed)"),d=new Set,p=new Set,o="",f=!1,S=Date.now(),g="production";function P(t){g=t.mode}var h=class{constructor(e){this.callback=e}register(e,i){}unregister(e){}},z=globalThis.FinalizationRegistry||h,s={byId:new Map,gc:{get alive(){return s.gc.created-s.gc.finalized},get active(){return s.gc.created-s.gc.disposed},created:0,disposed:0,finalized:0,watcher:new z(t=>{s.gc.finalized=s.gc.finalized+1})},track(t){g==="debug"&&(s.byId.set(t.id,t),s.gc.watcher.register(t,t.id),s.gc.created=s.gc.created+1)},untrack(t){g==="debug"&&(s.byId.delete(t.id),s.gc.disposed=s.gc.disposed+1,s.gc.watcher instanceof h&&s.gc.watcher.callback(t.id))}};function U(t,e){let i=o;o=t+"_";let u=e();return o=i,u}function v(){return(S++).toString(36)}var Q=t=>t instanceof c,B=t=>t instanceof l,F=t=>t instanceof n;function y(){d.forEach(t=>{t()}),d.clear()}function O(){p.forEach(t=>{t()}),p.clear()}function T(...t){t.forEach(e=>{"dispose"in e?e.dispose():console.error("Cannot dispose",e)})}var r=class t{constructor(e,i){this.listener=e;this.callback=i}static current=null;static run(e,i){let u=new t(e,i),L=t.current;t.current=u,i(),t.current=L}};function b(t,e){t._signals.add(e)}function w(t,e,i=!1){t._signals.delete(e),i&&t.dispose()}function x(t,e){t._listeners.add(e)}function _(t,e,i){t._listeners.delete(e)}function k(t){t._notify()}var c=class{id=o+"S"+v();_value;_listeners=new Set;constructor(e){this._value=e,s.track(this)}peek(){return this._value}get=()=>{if(this._value===a)throw new Error("Signal is disposed");return r.current&&(x(this,r.current.listener),b(r.current.listener,this)),this._value};set(e,i=!1){return this._value!==e||i?(this._value=e,this._value===a?(this._listeners.forEach(u=>{w(u,this,!0)}),this._listeners.clear(),s.untrack(this),!1):(f?p.add(this._notify):(this._notify(),y()),!0)):!1}subscribe(e){return new n(()=>{e(this.get())})}dispose=()=>{this._value!==a&&this.set(a)};_notify=()=>{this._listeners.forEach(e=>{k(e)})};static internals(e){return{signal:e,_value:e._value,_listeners:e._listeners}}},l=class{constructor(e){this._fn=e;s.track(this)}id=o+"C"+v();_value;_isStale=!0;_signals=new Set;_listeners=new Set;peek(){return this._value}get=()=>{if(this._value===a)throw new Error("Computed is disposed");return this._isStale&&(this._signals.forEach(e=>{_(e,this)}),this._signals.clear(),r.current&&(x(this,r.current.listener),b(r.current.listener,this)),r.run(this,()=>{this._derive()})),this._value};subscribe(e){return new n(()=>{e(this.get())})}dispose=()=>{this._value!==a&&(this._listeners.forEach(e=>{w(e,this,!0)}),this._listeners.clear(),this._signals.forEach(e=>{_(e,this,!0)}),this._signals.clear(),this._value=a,s.untrack(this))};_derive(){this._value=this._fn(),this._isStale=!1}_notify(){this._isStale||(this._isStale=!0,this._listeners.forEach(e=>{k(e)}))}static internals(e){return{computed:e,_value:e._value,_isStale:e._isStale,_signals:e._signals,_listeners:e._listeners}}},n=class{constructor(e){this._fn=e;s.track(this),this._run()}id=o+"E"+v();_signals=new Set;_isStale=!0;_isDisposed=!1;_dispose=I;_run=()=>{if(this._isDisposed)return console.warn("Effect run skipped due to disposed");this._isStale&&(this._signals.forEach(e=>{_(e,this)}),this._signals.clear(),r.run(this,()=>{this._dispose=this._fn()||this._dispose})),this._isStale=!1};_notify(){this._isDisposed||this._isStale||(this._isStale=!0,d.add(this._run))}dispose=()=>{this._isDisposed||(this._isDisposed=!0,this._dispose(),this._signals.forEach(e=>{_(e,this,!0)}),this._signals.clear(),s.untrack(this))};static internals(e){return{effect:e,_signals:e._signals,_isStale:e._isStale,_isDisposed:e._isDisposed,_innerDispose:e._dispose}}};function E(t){f=!0;try{return t()}finally{f=!1,O(),y()}}function D(t){return new c(t)}function m(t){return new l(t)}function C(t){return new n(t)}globalThis._pulse_={devTools:s,internals:{effectQueue:d,batchedUpdateQueue:p,get inBatch(){return f},get lastUid(){return S},get _idPrefx(){return o}},dispose:T,Signal:c,Computed:l,Effect:n,batch:E,signal:D,computed:m,effect:C};export{P as a,s as b,U as c,v as d,Q as e,B as f,F as g,T as h,r as i,c as j,l as k,n as l,E as m,D as n,m as o,C as p};
