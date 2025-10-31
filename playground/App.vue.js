import _sfc_main from "./App.vue?vue&type=script&setup=true&lang.ts";

export * from "./App.vue?vue&type=script&setup=true&lang.ts";
var _sfc_render = function render() {
  var _vm = this, _c = _vm._self._c, _setup = _vm._self._setupProxy;
  return _c("div", [_c("h1", [_vm._v("Vite-Plugin-Vue2 Playground")]), _c(_setup.ScriptSetup, { attrs: { msg: "prop from parent" } }), _c(_setup.TestBlockSrcImport), _c(_setup.TestScopedCss), _c(_setup.TestCssModules), _c(_setup.TestCustomBlock), _c(_setup.TestEmptyCss), _c(_setup.TestHmr), _c(_setup.TestAssets), _c(_setup.TestES2020Features), _c(_setup.TestComponent), _c(_setup.TestCssVBind)], 1);
};
var _sfc_staticRenderFns = [];
_sfc_render._withStripped = true;
import __normalizer from "\x00plugin-vue2:normalizer";
var __component__ = __normalizer(_sfc_main, _sfc_render, _sfc_staticRenderFns, false, null, null, null, null);
__component__.options.__file = "./App.vue";
export default __component__.exports;
