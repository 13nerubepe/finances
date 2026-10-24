from rest_framework.pagination import PageNumberPagination


class PaginationStandard(PageNumberPagination):
    page_size = 100
    page_size_query_param = "taille"
    max_page_size = 1000


class PaginationCours(PaginationStandard):

    page_size = 500
    max_page_size = 5000