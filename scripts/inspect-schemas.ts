import { gmailEndpointSchemas } from "@corsair-dev/gmail";

console.log("messages.get output schema keys:");
const outputSchema = gmailEndpointSchemas["messages.get"].output;
if (outputSchema && outputSchema.shape) {
  console.log(Object.keys(outputSchema.shape));
  if (outputSchema.shape.payload) {
    console.log("payload schema shape keys:");
    if (outputSchema.shape.payload.shape) {
      console.log(Object.keys(outputSchema.shape.payload.shape));
      if (outputSchema.shape.payload.shape.headers) {
        console.log("payload.headers schema:", typeof outputSchema.shape.payload.shape.headers);
      }
    } else {
      console.log("payload is not a ZodObject:", outputSchema.shape.payload.constructor.name);
    }
  }
} else {
  console.log("outputSchema is not a ZodObject:", outputSchema?.constructor?.name);
}
process.exit(0);
