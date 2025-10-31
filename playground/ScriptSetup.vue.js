import _sfc_main from "./ScriptSetup.vue?vue&type=script&setup=true&lang.ts";

export * from "./ScriptSetup.vue?vue&type=script&setup=true&lang.ts";
var _sfc_render = function render() {
  var _vm = this, _c = _vm._self._c, _setup = _vm._self._setupProxy;
  return _c("div", { directives: [{ name: "red", rawName: "v-red" }], staticClass: "script-setup" }, [_vm._v(" This should be red. "), _c("span", { staticClass: "prop" }, [_vm._v(_vm._s(_vm.msg))]), _c("button", { on: { click: function($event) {
    _setup.count++;
  } } }, [_vm._v(_vm._s(_setup.count))])]);
};
var _sfc_staticRenderFns = [];
_sfc_render._withStripped = true;
import __normalizer from "\x00plugin-vue2:normalizer";
var __component__ = __normalizer(_sfc_main, _sfc_render, _sfc_staticRenderFns, false, null, null, null, null);
__component__.options.__file = "./ScriptSetup.vue";
export default __component__.exports;
