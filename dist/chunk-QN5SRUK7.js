var t=null;function h(){return t}function p(n){t=n}var a=[],s=!1,l=new Set,u=class{_value;subscribers=new Set;dependents=new Set;constructor(e){this._value=e}get value(){return t&&(this.dependents.add(t),t.dependencies.add(this)),this._value}set value(e){this._value!==e&&(this._value=e,new Set(this.dependents).forEach(i=>i.invalidate()),this.subscribers.forEach(i=>i(e)))}peek(){return this._value}get(){return this.value}set(e){this.value=e}update(e){this.set(e(this._value))}subscribe(e){return e(this._value),this.subscribers.add(e),()=>{this.subscribers.delete(e)}}},o=class{fn;dependencies=new Set;isRunning=!1;onInvalidate=null;constructor(e){this.fn=e,this.run()}run(){if(!this.isRunning){this.isRunning=!0,this.cleanup(),a.push(this),t=this;try{this.fn()}finally{a.pop(),t=a[a.length-1]||null,this.isRunning=!1}}}invalidate(){s?l.add(this):this.onInvalidate?this.onInvalidate():this.run()}cleanup(){this.dependencies.forEach(e=>e.dependents.delete(this)),this.dependencies.clear()}},r=class{signal;constructor(e){this.signal=e}get value(){return this.signal.value}peek(){return this.signal.peek()}get(){return this.signal.get()}subscribe(e){return this.signal.subscribe(e)}};function v(n){return new u(n)}function d(n){new o(n)}function f(n){let e=new u(void 0);return d(()=>{e.value=n()}),new r(e)}function T(n){let e=s;s=!0;try{n()}finally{if(s=e,!s){let c=Array.from(l);l.clear(),c.forEach(i=>i.run())}}}export{h as a,p as b,u as c,o as d,v as e,d as f,f as g,T as h};
