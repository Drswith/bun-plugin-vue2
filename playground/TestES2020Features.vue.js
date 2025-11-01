import _sfc_main from "/Users/drs/workspaces/personal/bun-plugin-vue2/playground/TestES2020Features.vue?vue&type=script&lang.ts";

export * from "/Users/drs/workspaces/personal/bun-plugin-vue2/playground/TestES2020Features.vue?vue&type=script&lang.ts";
var _sfc_render = function render() {
  var _vm = this, _c = _vm._self._c, _setup = _vm._self._setupProxy;
  return _c("div", [_c("h2", [_vm._v("ES2020 Features")]), _c("h3", [_vm._v("Nullish Coalescing and Optional Chaining")]), _c("code", [_vm._v(" [nullish.a.b.c.d ?? 'not found'] "), _c("br"), _vm._v(" //returns " + _vm._s(_vm.nullish.a.d?.e ?? "not found") + " "), _c("br"), _c("br"), _vm._v(" [nullish.a.b.c ?? 'not found'] "), _c("br"), _vm._v(" //returns " + _vm._s(_vm.nullish.a.b.c ?? "not found") + " ")]), _c("h3", [_vm._v("Spread Operator")]), _c("code", [_vm._v(` ["Test", 1, ...('abc').split('')] `), _c("br"), _vm._v(" //returns " + _vm._s(["Test", 1, ..."abc".split("")]) + " ")])]);
};
var _sfc_staticRenderFns = [];
_sfc_render._withStripped = true;
import __normalizer from "\x00plugin-vue2:normalizer";
var __component__ = __normalizer(_sfc_main, _sfc_render, _sfc_staticRenderFns, false, null, null, null, null);
__component__.options.__file = "/Users/drs/workspaces/personal/bun-plugin-vue2/playground/TestES2020Features.vue";
export default __component__.exports;
