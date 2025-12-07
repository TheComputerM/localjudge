import type { Table } from "@tanstack/react-table";
import { useMemo } from "react";
import { Button } from "../ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "../ui/pagination";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

export default function DataTablePagination<TData>({
	table,
}: {
	table: Table<TData>;
}) {
	const pages = useMemo(
		() =>
			Array.from({ length: table.getPageCount() }, (_, i) => ({
				label: i + 1,
				value: i,
			})),
		[table],
	);

	return (
		<Pagination>
			<PaginationContent className="w-full justify-between gap-2">
				<PaginationItem>
					<PaginationPrevious
						className="sm:*:[svg]:hidden"
						render={
							<Button
								variant="outline"
								disabled={!table.getCanPreviousPage()}
								onClick={() => table.previousPage()}
							/>
						}
					/>
				</PaginationItem>
				<PaginationItem className="mx-2">
					<div
						className="text-sm text-muted-foreground inline-flex items-center gap-1.5"
						aria-live="polite"
					>
						Page
						<Select
							items={pages}
							value={table.getState().pagination.pageIndex}
							onValueChange={(value) => {
								if (value) table.setPageIndex(value);
							}}
						>
							<SelectTrigger
								size="sm"
								className="min-w-none w-min"
								aria-label="Select page"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectPopup>
								{pages.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectPopup>
						</Select>
						of
						<span className="text-foreground">{table.getPageCount()}</span>
					</div>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext
						className="sm:*:[svg]:hidden"
						render={
							<Button
								variant="outline"
								disabled={!table.getCanNextPage()}
								onClick={() => table.nextPage()}
							/>
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
