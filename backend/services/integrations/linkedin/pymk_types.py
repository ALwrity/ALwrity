"""PYMK cohort types and Unipile raw-request builders."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional


class PymkCohort(str, Enum):
    """Supported People You May Know cohort filters."""

    RECENT_ACTIVITY = "recent_activity"
    SAME_SCHOOL = "same_school"
    SAME_JOB = "same_job"
    SAME_INDUSTRY = "same_industry"


COHORT_LABELS: dict[PymkCohort, str] = {
    PymkCohort.RECENT_ACTIVITY: "Based on your recent activity",
    PymkCohort.SAME_SCHOOL: "People from your school",
    PymkCohort.SAME_JOB: "People in similar roles",
    PymkCohort.SAME_INDUSTRY: "People in your industry",
}

PAGER_ID = "com.linkedin.sdui.pagers.mynetwork.addaCohortSeeAll"
SCREEN_ID = "com.linkedin.sdui.flagshipnav.mynetwork.CohortSeeAll"
LINKEDIN_PAGINATION_URL = "https://www.linkedin.com/flagship-web/rsc-action/actions/pagination"


def _base_payload(
    cohort: PymkCohort,
    *,
    page_start: int,
    page_size: int,
    cohort_id: Optional[str] = None,
) -> dict[str, Any]:
    """Build the SDUI pagination payload for a cohort."""
    is_first_page = page_start <= 0
    payload: dict[str, Any] = {
        "shouldUseIndexPaging": True,
        "pageStart": max(0, page_start),
        "pageSize": max(1, min(page_size, 50)),
        "isFirstPage": is_first_page,
    }

    if cohort == PymkCohort.RECENT_ACTIVITY:
        payload.update(
            {
                "cohortReasonSource": "IN_SESSION_RELEVANCE",
                "cohortReasonContext": "IN_SESSION_RELEVANCE",
            }
        )
    elif cohort == PymkCohort.SAME_SCHOOL:
        if not cohort_id:
            raise ValueError("school_id is required for same_school cohort")
        payload.update(
            {
                "cohortReasonSource": "PYMK_SCHOOL_COHORT",
                "cohortReasonContext": "SCHOOL",
                "cohortReasonRelatedSchoolUrns": [{"schoolId": int(cohort_id)}],
            }
        )
    elif cohort == PymkCohort.SAME_JOB:
        if not cohort_id:
            raise ValueError("super_title_id is required for same_job cohort")
        payload.update(
            {
                "cohortReasonSource": "PYMK_TITLE_COHORT",
                "cohortReasonContext": "TITLE",
                "cohortReasonRelatedSuperTitleUrns": [{"superTitleId": str(cohort_id)}],
            }
        )
    elif cohort == PymkCohort.SAME_INDUSTRY:
        if not cohort_id:
            raise ValueError("industry_id is required for same_industry cohort")
        payload.update(
            {
                "cohortReasonSource": "PYMK_INDUSTRY_COHORT",
                "cohortReasonContext": "INDUSTRY",
                "cohortReasonRelatedIndustryUrns": [{"industryId": int(cohort_id)}],
            }
        )
    else:
        raise ValueError(f"Unsupported cohort: {cohort}")

    return payload


def _requested_arguments(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "$type": "proto.sdui.actions.requests.RequestedArguments",
        "payload": payload,
        "requestMetadata": {"$type": "proto.sdui.common.RequestMetadata"},
    }


def build_pymk_unipile_request(
    account_id: str,
    cohort: PymkCohort,
    *,
    page_start: int = 0,
    page_size: int = 10,
    cohort_id: Optional[str] = None,
) -> dict[str, Any]:
    """Build the body for Unipile POST /api/v1/linkedin (PYMK magic route).

    LinkedIn's SDUI pagination uses pageStart and pageSize parameters.
    There is no explicit cursor/token in the response - pagination is
    determined by comparing result count to requested pageSize.
    """
    payload = _base_payload(
        cohort,
        page_start=page_start,
        page_size=page_size,
        cohort_id=cohort_id,
    )
    requested = _requested_arguments(payload)

    return {
        "account_id": account_id,
        "request_url": LINKEDIN_PAGINATION_URL,
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": {
            "pagerId": PAGER_ID,
            "clientArguments": {
                **_requested_arguments(payload),
                "states": [],
                "screenId": SCREEN_ID,
            },
            "paginationRequest": {
                "$type": "proto.sdui.actions.requests.PaginationRequest",
                "pagerId": PAGER_ID,
                "requestedArguments": requested,
            },
        },
    }
