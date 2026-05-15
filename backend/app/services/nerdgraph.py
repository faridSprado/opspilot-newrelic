from __future__ import annotations

from typing import Literal


def endpoint_for_region(region: Literal["US", "EU"]) -> str:
    return "https://api.eu.newrelic.com/graphql" if region == "EU" else "https://api.newrelic.com/graphql"


VALIDATE_CREDENTIALS_QUERY = """
query ValidateNewRelicCredentials {
  actor {
    user { name email }
    accounts { id name }
  }
}
"""

RUN_NRQL_QUERY = """
query RunNrql($accountId: Int!, $nrql: Nrql!) {
  actor {
    account(id: $accountId) {
      nrql(query: $nrql) {
        results
        metadata { eventTypes facets messages timeWindow { begin end } }
      }
    }
  }
}
"""

ENTITY_SEARCH_QUERY = """
query SearchEntities($query: String!, $cursor: String) {
  actor {
    entitySearch(query: $query) {
      count
      results(cursor: $cursor) {
        nextCursor
        entities {
          guid
          name
          type
          domain
          permalink
          alertSeverity
          reporting
          tags { key values }
        }
      }
    }
  }
}
"""
