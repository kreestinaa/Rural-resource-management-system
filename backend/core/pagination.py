from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    Page-number pagination that ALSO honours a ?page_size= query parameter.

    Django REST Framework's default PageNumberPagination ignores ?page_size=
    unless page_size_query_param is set. Without this, the Disbursement page
    asked for 500 allocation results and silently received only 20 — so an
    admin could see just 20 of the 150 schools in a cycle.

    max_page_size is capped so a client cannot request an unbounded page.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500
