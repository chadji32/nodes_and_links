export interface Activity {
  nodeId: string;
  startDate: string; // 'yyyy-mm-dd'
  endDate: string;   // 'yyyy-mm-dd'
}

export interface ApiActivitiesResponse {
  valid: boolean;
  errors: string[];
  data: Activity[];
}

export interface ApiAdjacencyResponse {
  valid: boolean;
  errors: string[];
  matrix: number[][];
}

export interface Link {
  from: Activity;
  to: Activity;
}

export interface CombinedLink {
  from: Activity;
  to: Activity;
  gapDays: number;   // <— new
}

export interface LinkResponse {
  links: CombinedLink[];   // now includes gapDays
}