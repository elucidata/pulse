// Only for testing purposes
import { GlobalRegistrator } from "@happy-dom/global-registrator"

const oldConsole = console
GlobalRegistrator.register()
window.console = oldConsole
// GlobalRegistrator.register()
