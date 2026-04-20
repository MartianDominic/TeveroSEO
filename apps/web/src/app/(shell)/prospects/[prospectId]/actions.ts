"use server";

import { getProspect as getProspectBase } from "../actions";

export async function getProspectDetail(id: string) {
  return getProspectBase(id);
}
