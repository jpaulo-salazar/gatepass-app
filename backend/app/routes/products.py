from fastapi import APIRouter, Header, HTTPException
from app.database import get_db
from app.schemas import ProductCreate, ProductResponse, ProductsBulkCreate, ProductsBulkResponse
from app.routes.users import get_current_user_id

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=list[ProductResponse])
def list_products(authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, item_code, item_description, item_group FROM products ORDER BY item_group, item_code")
            rows = cur.fetchall()
    return [ProductResponse(id=r["id"], item_code=r["item_code"], item_description=r["item_description"], item_group=r.get("item_group")) for r in rows]

@router.post("", response_model=ProductResponse)
def create_product(product: ProductCreate, authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM products WHERE item_code = %s", (product.item_code,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Item code already exists")
            cur.execute(
                "INSERT INTO products (item_code, item_description, item_group) VALUES (%s, %s, %s)",
                (product.item_code, product.item_description, product.item_group or None)
            )
            cur.execute("SELECT id, item_code, item_description, item_group FROM products WHERE id = LAST_INSERT_ID()")
            row = cur.fetchone()
    return ProductResponse(id=row["id"], item_code=row["item_code"], item_description=row["item_description"], item_group=row.get("item_group"))

@router.post("/bulk", response_model=ProductsBulkResponse)
def create_products_bulk(body: ProductsBulkCreate, authorization: str = Header(None, alias="Authorization")):
    """Insert multiple products. Skips rows whose item_code already exists; returns created and skipped counts."""
    get_current_user_id(authorization)
    created = 0
    skipped_codes = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for p in body.items:
                item_code = (p.item_code or "").strip()
                item_description = (p.item_description or "").strip()
                if not item_code or not item_description:
                    continue
                cur.execute("SELECT id FROM products WHERE item_code = %s", (item_code,))
                if cur.fetchone():
                    skipped_codes.append(item_code)
                    continue
                cur.execute(
                    "INSERT INTO products (item_code, item_description, item_group) VALUES (%s, %s, %s)",
                    (item_code, item_description, (p.item_group or "").strip() or None),
                )
                created += 1
    return ProductsBulkResponse(created=created, skipped=len(skipped_codes), skipped_codes=skipped_codes)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product: ProductCreate, authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM products WHERE id = %s", (product_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Product not found")
            cur.execute(
                "UPDATE products SET item_code=%s, item_description=%s, item_group=%s WHERE id=%s",
                (product.item_code, product.item_description, product.item_group or None, product_id)
            )
            cur.execute("SELECT id, item_code, item_description, item_group FROM products WHERE id = %s", (product_id,))
            row = cur.fetchone()
    return ProductResponse(id=row["id"], item_code=row["item_code"], item_description=row["item_description"], item_group=row.get("item_group"))

@router.delete("/{product_id}")
def delete_product(product_id: int, authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True}
