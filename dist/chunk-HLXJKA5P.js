var n=null;function f(){return n}function g(t){n=t}var u=[],s=!1,l=new Set,a=class{_value;subscribers=new Set;dependents=new Set;constructor(e){this._value=e}get value(){return n&&(this.dependents.add(n),n.dependencies.add(this)),this._value}set value(e){this._value!==e&&(this._value=e,new Set(this.dependents).forEach(i=>i.invalidate()),this.subscribers.forEach(i=>i(e)))}peek(){return this._value}get(){return this.value}set(e){this.value=e}update(e){this.set(e(this._value))}subscribe(e){return e(this._value),this.subscribers.add(e),()=>{this.subscribers.delete(e)}}},o=class{fn;dependencies=new Set;isRunning=!1;onInvalidate=null;constructor(e){this.fn=e,this.run()}run(){if(!this.isRunning){this.isRunning=!0,this.cleanup(),u.push(this),n=this;try{this.fn()}finally{u.pop(),n=u[u.length-1]||null,this.isRunning=!1}}}invalidate(){s?l.add(this):this.onInvalidate?this.onInvalidate():this.run()}cleanup(){this.dependencies.forEach(e=>e.dependents.delete(this)),this.dependencies.clear()}},r=class{signal;constructor(e){this.signal=e}get value(){return this.signal.value}peek(){return this.signal.peek()}get(){return this.signal.get()}subscribe(e){return this.signal.subscribe(e)}};function h(t){return new a(t)}function d(t){new o(t)}function p(t){let e=new a(void 0);return d(()=>{e.value=t()}),new r(e)}function v(t){let e=s;s=!0;try{t()}finally{if(s=e,!s){let c=Array.from(l);l.clear(),c.forEach(i=>i.run())}}}export{f as a,g as b,a as c,o as d,h as e,d as f,p as g,v as h};