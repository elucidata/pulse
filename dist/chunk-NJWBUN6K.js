var e=null;function d(){return e}function h(t){e=t}var o=[],a=!1,l=new Set,u=class{_value;subscribers=new Set;dependents=new Set;constructor(n){this._value=n}get value(){return e&&(this.dependents.add(e),e.dependencies.add(this)),this._value}set value(n){this._value!==n&&(this._value=n,new Set(this.dependents).forEach(s=>s.invalidate()),this.subscribers.forEach(s=>s(n)))}peek(){return this._value}get(){return this.value}set(n){this.value=n}update(n){this.set(n(this._value))}subscribe(n){return n(this._value),this.subscribers.add(n),()=>{this.subscribers.delete(n)}}},r=class{fn;dependencies=new Set;isRunning=!1;onInnerCleanup=void 0;onInvalidate=null;parentComputation;childComputations=new Set;constructor(n,i=null){this.fn=n,this.parentComputation=i,this.run()}run(){if(!this.isRunning){this.isRunning=!0,this.cleanup(),o.push(this),e=this;try{let n=this.fn();typeof n=="function"?this.onInnerCleanup=n:this.onInnerCleanup=void 0}finally{o.pop(),e=o[o.length-1]||null,this.isRunning=!1}}}invalidate(){a?l.add(this):this.onInvalidate?this.onInvalidate():this.run()}cleanup(){this.isRunning||(this.isRunning=!0,this.childComputations.forEach(n=>{n.cleanup()}),this.childComputations.clear(),this.onInnerCleanup&&(this.onInnerCleanup(),this.onInnerCleanup=void 0),this.dependencies.forEach(n=>n.dependents.delete(this)),this.dependencies.clear(),this.parentComputation&&this.parentComputation.childComputations.delete(this),this.isRunning=!1)}},c=class{signal;cleanup;constructor(n){this.signal=new u(void 0),this.cleanup=p(()=>{this.signal.value=n()})}get value(){return this.signal.value}peek(){return this.signal.peek()}get(){return this.signal.get()}subscribe(n){return this.signal.subscribe(n)}};function v(t){return new u(t)}function p(t){let n=e,i=new r(t,n);return n&&n.childComputations.add(i),()=>i.cleanup()}function f(t){return new c(t)}function T(t){let n=a;a=!0;try{t()}finally{if(a=n,!a){let i=Array.from(l);l.clear(),i.forEach(s=>s.run())}}}function g(t){return typeof t=="object"&&t!==null&&"get"in t&&"peek"in t&&"subscribe"in t}export{d as a,h as b,u as c,r as d,v as e,p as f,f as g,T as h,g as i};