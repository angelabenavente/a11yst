
const TEMPLATE_URL = "./missing.component.html";

@Component({
  selector: "app-dynamic",
  templateUrl: TEMPLATE_URL,
})
export class DynamicMetadataComponent {}

@Component({
  selector: "app-dynamic-template",
  template: TEMPLATE,
})
export class DynamicTemplateComponent {}

const TEMPLATE = `<button>Dynamic</button>`;
