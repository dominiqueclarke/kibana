<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [kibana-plugin-plugins-expressions-public](./kibana-plugin-plugins-expressions-public.md) &gt; [ExecutionContract](./kibana-plugin-plugins-expressions-public.executioncontract.md) &gt; [getData](./kibana-plugin-plugins-expressions-public.executioncontract.getdata.md)

## ExecutionContract.getData property

Returns the final output of expression, if any error happens still wraps that error into `ExpressionValueError` type and returns that. This function never throws.

<b>Signature:</b>

```typescript
getData: () => Promise<Output | ExpressionValueError>;
```
