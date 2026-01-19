import type { paths } from "../../../packages/sdk/src/openapi-types";

type Assert<T extends true> = T;
type HasPath<P extends string> = P extends keyof paths ? true : false;
type HasMethod<P extends keyof paths, M extends string> = M extends keyof paths[P] ? true : false;

export type OpenApiContract = [
  Assert<HasPath<"/health">>,
  Assert<HasPath<"/ready">>,
  Assert<HasPath<"/flags">>,
  Assert<HasPath<"/flags/{key}">>,
  Assert<HasMethod<"/flags", "get">>,
  Assert<HasMethod<"/auth/login", "post">>,
  Assert<HasMethod<"/auth/me", "get">>,
  Assert<HasMethod<"/campgrounds", "get">>,
  Assert<HasMethod<"/reservations", "post">>
];
