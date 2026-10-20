//permissionMiddleware.js

const pool=require("../db");
const normalize=(v)=>String(v||"").trim().toLowerCase();
const SUPER_USERS=["admin","it"];

const getPrimaryDepartment=(user)=>
  String(
    user?.department||
    user?.department_name||
    user?.user_department||
    user?.departmentName||
    user?.dept||
    ""
  ).trim();

const getDepartmentScopes=(user)=>{
  const primary=getPrimaryDepartment(user);

  const scopes=Array.isArray(user?.department_scopes)
    ? user.department_scopes
    : [];

  const all=[
    ...(primary?[primary]:[]),
    ...scopes,
  ]
    .map((d)=>String(d||"").trim())
    .filter(Boolean);

  const seen=new Set();

  return all.filter((department)=>{
    const key=normalize(department);

    if(!key||seen.has(key)){
      return false;
    }

    seen.add(key);
    return true;
  });
};

const hasPermission = async (user, moduleName, actionName) => {
  try {
    const role = normalize(user?.role);

    if (!role) {
      return false;
    }

    if (SUPER_USERS.includes(role)) {
      return true;
    }

    const departments = getDepartmentScopes(user);
    const normalizedDepartments = departments.map(normalize);

    const result = await pool.query(
      `
      SELECT COALESCE(BOOL_OR(allowed), FALSE) AS allowed
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role, ''))) = $1
        AND module_name = $2
        AND action_name = $3
        AND (
          LOWER(TRIM(COALESCE(department, ''))) =
            ANY($4::text[])
          OR department IS NULL
          OR TRIM(department) = ''
        )
      `,
      [
        role,
        moduleName,
        actionName,
        normalizedDepartments,
      ]
    );

    return result.rows[0]?.allowed === true;

  } catch (err) {
    console.error("HAS PERMISSION ERROR:", err.message);
    return false;
  }
};

const requirePermission=(moduleName,actionName)=>{
  return async(req,res,next)=>{
    try{
      const allowed=await hasPermission(req.user, moduleName, actionName );

      if(!allowed){
        return res.status(403).json({
          message:`No permission for ${moduleName}:${actionName}`,
        });
      }

      return next();
    } catch(err) {
      console.error("PERMISSION ERROR:", err.message);

      return res.status(500).json({
        message:"Permission check failed",
      });
    }
  };
};

const getUserPermissionMap=async(user)=>{
  const role=normalize(user?.role);

  if(!role){
    return{
      is_super_user:false,
      permissions:{},
    };
  }

  if(SUPER_USERS.includes(role)){
    return{
      is_super_user:true,
      permissions:{},
    };
  }

  const departments=getDepartmentScopes(user);
  const normalizedDepartments=departments.map(normalize);

  let r;

  if(normalizedDepartments.length>0){
    r=await pool.query(
      `
      SELECT
        module_name,
        action_name,
        allowed,
        department
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
        AND (
          LOWER(TRIM(COALESCE(department,'')))=ANY($2::text[])
          OR department IS NULL
          OR TRIM(department)=''
        )
      ORDER BY id ASC
      `,
      [role, normalizedDepartments,]
    );
  } else {
    r=await pool.query(
      `
      SELECT
        module_name,
        action_name,
        allowed,
        department
      FROM public.role_permissions
      WHERE LOWER(TRIM(COALESCE(role,'')))=LOWER(TRIM($1))
        AND (
          department IS NULL
          OR TRIM(department)=''
        )
      ORDER BY id ASC
      `,
      [role]
    );
  }

  console.log("ROLE =",role);
  console.log("PRIMARY DEPARTMENT =",getPrimaryDepartment(user));
  console.log("DEPARTMENT SCOPES =",departments);
  console.log("ROWS =",r.rows);

  const permissions={};

  for(const row of r.rows){
    if(!permissions[row.module_name]){
      permissions[row.module_name]={};
    }

    const current=Boolean(permissions[row.module_name][row.action_name]);

    permissions[row.module_name][row.action_name] = current||Boolean(row.allowed);
  }

  return{
    is_super_user:false,
    permissions,
  };
};

module.exports={
  requirePermission,
  hasPermission,
  getUserPermissionMap,
  getDepartmentScopes,
};