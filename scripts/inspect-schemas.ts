import { gmailEndpointSchemas } from "@corsair-dev/gmail";

console.log("messages.get output schema keys:");
const outputSchema = gmailEndpointSchemas["messages.get"].output;
if (outputSchema && outputSchema.shape) {
  console.log(Object.keys(outputSchema.shape));
  if (outputSchema.shape.payload) {
    console.log("payload schema shape keys:");
    const payloadSchema = outputSchema.shape.payload as any;
    if (payloadSchema.shape) {
      console.log(Object.keys(payloadSchema.shape));
      if (payloadSchema.shape.headers) {
        console.log("payload.headers schema:", typeof payloadSchema.shape.headers);
      }
    } else {
      console.log("payload is not a ZodObject:", (outputSchema.shape.payload as any).constructor.name);
    }
  }
} else {
  console.log("outputSchema is not a ZodObject:", outputSchema?.constructor?.name);
}
process.exit(0);
