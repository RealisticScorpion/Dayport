# Background JSON source

Dayport can rotate background images from a JSON endpoint you control. Add its address under **Background images → JSON source** on the options page. Dayport asks Chrome for permission to read that one site, fetches the list, and refreshes it at most every six hours. A failed refresh keeps the previous list.

## Format

The endpoint must be `https` and return JSON in either shape:

```json
["https://images.example.com/1.jpg", "https://images.example.com/2.jpg"]
```

```json
{
  "images": [
    {
      "url": "https://images.example.com/1.jpg",
      "credit": "Photo by Ana",
      "link": "https://example.com/ana"
    }
  ]
}
```

| Field    | Required | Rules                                                              |
| -------- | -------- | ------------------------------------------------------------------ |
| `url`    | Yes      | `https` only, up to 2048 characters                                |
| `credit` | No       | Plain text, trimmed to 120 characters; shown in the corner control |
| `link`   | No       | `http` or `https`; the credit links to it                          |

Dayport keeps up to 500 images, drops duplicates, and skips any entry that breaks these rules. The response is treated as data only: nothing in it is executed or rendered as HTML. Images load directly from their own hosts, which receive ordinary request metadata such as the IP address.

If your images come from a provider with attribution rules, put the required credit and link in each entry.
