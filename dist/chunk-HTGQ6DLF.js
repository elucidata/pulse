var t=null;function p(){return t}function h(n){t=n}var a=[],s=!1,o=new Set,u=class{_value;subscribers=new Set;dependents=new Set;constructor(e){this._value=e}get value(){return t&&(this.dependents.add(t),t.dependencies.add(this)),this._value}set value(e){this._value!==e&&(this._value=e,new Set(this.dependents).forEach(i=>i.invalidate()),this.subscribers.forEach(i=>i(e)))}peek(){return this._value}get(){return this.value}set(e){this.value=e}update(e){this.set(e(this._value))}subscribe(e){return e(this._value),this.subscribers.add(e),()=>{this.subscribers.delete(e)}}},l=class{fn;dependencies=new Set;isRunning=!1;onInnerCleanup=void 0;onInvalidate=null;constructor(e){this.fn=e,this.run()}run(){if(!this.isRunning){this.isRunning=!0,this.cleanup(),a.push(this),t=this;try{this.onInnerCleanup=this.fn()}finally{a.pop(),t=a[a.length-1]||null,this.isRunning=!1}}}invalidate(){s?o.add(this):this.onInvalidate?this.onInvalidate():this.run()}cleanup(){this.onInnerCleanup&&(console.groupCollapsed("effect cleanup"),console.log("src",this.fn),console.groupEnd(),this.onInnerCleanup(),this.onInnerCleanup=void 0),this.dependencies.forEach(e=>e.dependents.delete(this)),this.dependencies.clear()}},r=class{signal;cleanup;constructor(e){this.signal=new u(void 0),this.cleanup=d(()=>{this.signal.value=e()})}get value(){return this.signal.value}peek(){return this.signal.peek()}get(){return this.signal.get()}subscribe(e){return this.signal.subscribe(e)}};function v(n){return new u(n)}function d(n){let e=new l(n);return()=>e.cleanup()}function f(n){return new r(n)}function T(n){let e=s;s=!0;try{n()}finally{if(s=e,!s){let c=Array.from(o);o.clear(),c.forEach(i=>i.run())}}}function g(n){return typeof n=="object"&&n!==null&&"get"in n&&"peek"in n&&"subscribe"in n}export{p as a,h as b,u as c,l as d,v as e,d as f,f as g,T as h,g as i};
